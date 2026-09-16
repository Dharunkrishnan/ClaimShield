# Multi-stage build - keeps the final image small (only the compiled
# app + runtime, not the full SDK/build tools).

# ---- Build stage ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy just the csproj first so Docker can cache the restore layer
# separately from your actual code - much faster rebuilds.
COPY ClaimShield.Api/*.csproj ./ClaimShield.Api/
RUN dotnet restore ./ClaimShield.Api/ClaimShield.Api.csproj

# Now copy everything else and build.
COPY ClaimShield.Api/ ./ClaimShield.Api/
WORKDIR /src/ClaimShield.Api
RUN dotnet publish -c Release -o /app/publish --no-restore

# ---- Runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Prevent inotify limit crash on container platforms (Render, Railway, etc.)
ENV DOTNET_USE_POLLING_FILE_WATCHER=true

# Tesseract.NET is just a wrapper around the native Tesseract OCR
# engine and its Leptonica image-processing dependency - neither is
# included in the base ASP.NET runtime image, so every OCR call was
# crashing with "Failed to find library libleptonica...so". This
# installs the actual native libraries the wrapper needs at runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        tesseract-ocr-eng \
        libtesseract-dev \
        libleptonica-dev \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/lib/x86_64-linux-gnu/liblept.so.5.0.4 /usr/lib/x86_64-linux-gnu/libleptonica-1.82.0.so \
    && ln -sf /usr/lib/x86_64-linux-gnu/libtesseract.so.5.0.3 /usr/lib/x86_64-linux-gnu/libtesseract50.so \
    && ldconfig

COPY --from=build /app/publish .

# Tesseract's native loader (InteropDotNet) checks the app's own base
# directory for these libraries, the same way it looks for DLLs
# sitting next to the .exe on Windows - a system-wide symlink alone
# isn't enough. Placing the real files directly in /app covers that.
# It also mirrors the NuGet package's Windows convention of an "x64"
# subfolder next to the app, so we cover that exact path too.
RUN cp /usr/lib/x86_64-linux-gnu/liblept.so.5.0.4 /app/libleptonica-1.82.0.so \
    && cp /usr/lib/x86_64-linux-gnu/libtesseract.so.5.0.3 /app/libtesseract50.so \
    && mkdir -p /app/x64 \
    && cp /usr/lib/x86_64-linux-gnu/liblept.so.5.0.4 /app/x64/libleptonica-1.82.0.so \
    && cp /usr/lib/x86_64-linux-gnu/libtesseract.so.5.0.3 /app/x64/libtesseract50.so \
    && mkdir -p /app/tessdata \
    && cp -rf /usr/share/tesseract-ocr/*/tessdata/* /app/tessdata/ 2>/dev/null || true \
    && cp -rf /usr/share/tessdata/* /app/tessdata/ 2>/dev/null || true

ENV TESSDATA_PREFIX=/app/tessdata/

# Render provides the port to listen on via the PORT env var at
# container start (not build time) - so this has to be expanded by a
# shell at runtime, not baked in with a plain ENV/EXPOSE instruction.
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-8080} dotnet ClaimShield.Api.dll"]