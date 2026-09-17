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

# Install native dependencies:
# - libc6-dev: provides libdl.so / dynamic linker headers on glibc >= 2.34 (Debian 12 Bookworm)
# - tesseract-ocr, tesseract-ocr-eng: core engine and english language models
# - libtesseract-dev, libleptonica-dev: native C++ libraries (libtesseract.so, liblept.so)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libc6-dev \
        tesseract-ocr \
        tesseract-ocr-eng \
        libtesseract-dev \
        libleptonica-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy compiled .NET app
COPY --from=build /app/publish .

# Tesseract .NET wrapper (charlesw/tesseract 5.2.0) requires:
# 1. libdl: 'libdl.so' (or 'libdl.so.2') for dynamic loading via InteropDotNet
# 2. Leptonica native library: 'libleptonica-1.82.0.so' (or 'liblept.so')
# 3. Tesseract native library: 'libtesseract50.so' (or 'libtesseract.so')
# InteropDotNet searches AppContext.BaseDirectory (/app), the /app/x64 folder, and system lib paths.
# We dynamically locate the installed libraries and link/copy them to all expected locations.
RUN LIBDL=$(find /lib /usr/lib -name "libdl.so*" 2>/dev/null | head -n 1) \
    && LEPT=$(find /usr/lib -name "liblept.so*" 2>/dev/null | head -n 1) \
    && TESS=$(find /usr/lib -name "libtesseract.so*" 2>/dev/null | head -n 1) \
    && echo "Found libdl: $LIBDL" \
    && echo "Found Leptonica: $LEPT" \
    && echo "Found Tesseract: $TESS" \
    && if [ -n "$LIBDL" ]; then \
         ln -sf "$LIBDL" /usr/lib/x86_64-linux-gnu/libdl.so 2>/dev/null || true; \
         mkdir -p /app/x64; \
         cp -P "$LIBDL" /app/libdl.so 2>/dev/null || true; \
         cp -P "$LIBDL" /app/x64/libdl.so 2>/dev/null || true; \
       fi \
    && ln -sf "$LEPT" /usr/lib/x86_64-linux-gnu/libleptonica-1.82.0.so 2>/dev/null || true \
    && ln -sf "$TESS" /usr/lib/x86_64-linux-gnu/libtesseract50.so 2>/dev/null || true \
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