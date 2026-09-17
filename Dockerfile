# Multi-stage build - keeps the final image small (only compiled app + runtime)

# ---- Build stage ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy just the csproj first so Docker can cache the restore layer
COPY ClaimShield.Api/*.csproj ./ClaimShield.Api/
RUN dotnet restore ./ClaimShield.Api/ClaimShield.Api.csproj

# Copy source and publish
COPY ClaimShield.Api/ ./ClaimShield.Api/
WORKDIR /src/ClaimShield.Api
RUN dotnet publish -c Release -o /app/publish --no-restore

# ---- Runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Prevent inotify limit crash on container platforms (Render, Railway, etc.)
ENV DOTNET_USE_POLLING_FILE_WATCHER=true

# Install native Tesseract, Leptonica, and English traineddata
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        tesseract-ocr-eng \
        libtesseract-dev \
        libleptonica-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy compiled .NET app
COPY --from=build /app/publish .

# Tesseract .NET wrapper (charlesw/tesseract 5.2.0) requires:
# 1. Leptonica native library: 'libleptonica-1.82.0.so' (or 'liblept.so')
# 2. Tesseract native library: 'libtesseract50.so' (or 'libtesseract.so')
# InteropDotNet searches AppContext.BaseDirectory (/app), the /app/x64 folder, and system lib paths.
# We dynamically locate the installed libraries and link/copy them to all expected locations.
RUN LEPT=$(find /usr/lib -name "liblept.so*" | head -n 1) \
    && TESS=$(find /usr/lib -name "libtesseract.so*" | head -n 1) \
    && echo "Found Leptonica: $LEPT" \
    && echo "Found Tesseract: $TESS" \
    && ln -sf "$LEPT" /usr/lib/x86_64-linux-gnu/libleptonica-1.82.0.so \
    && ln -sf "$TESS" /usr/lib/x86_64-linux-gnu/libtesseract50.so \
    && ldconfig \
    && mkdir -p /app/x64 \
    && cp -P "$LEPT" /app/libleptonica-1.82.0.so \
    && cp -P "$TESS" /app/libtesseract50.so \
    && cp -P "$LEPT" /app/x64/libleptonica-1.82.0.so \
    && cp -P "$TESS" /app/x64/libtesseract50.so \
    && mkdir -p /app/tessdata \
    && cp -rf /usr/share/tesseract-ocr/*/tessdata/* /app/tessdata/ 2>/dev/null || true \
    && cp -rf /usr/share/tessdata/* /app/tessdata/ 2>/dev/null || true

# Tesseract data directory environment variable (no trailing slash)
ENV TESSDATA_PREFIX=/app/tessdata

# Render provides the port to listen on via the PORT env var at runtime
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-8080} dotnet ClaimShield.Api.dll"]