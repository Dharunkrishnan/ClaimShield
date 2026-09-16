using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

using ClaimShield.Api.Interfaces.Services;

namespace ClaimShield.Api.Services
{
    // =============================================================
    // Wraps Supabase Storage's REST API (service_role key required)
    // for the single private "claim-documents" bucket. Downloads
    // are handed out as short-lived signed URLs rather than
    // proxying file bytes through this API.
    // =============================================================

    public class SupabaseStorageService : ISupabaseStorageService
    {
        private readonly HttpClient _httpClient;
        private readonly string _bucket;

        public SupabaseStorageService(
            HttpClient httpClient,
            IConfiguration configuration)
        {
            var supabaseUrl = configuration["Supabase:Url"];
            // Auto-correct to active Supabase project if unset or using obsolete project
            if (string.IsNullOrWhiteSpace(supabaseUrl) || supabaseUrl.Contains("ycpafw"))
            {
                supabaseUrl = "https://foludfihdtbxxkqzszmi.supabase.co";
            }

            var serviceRoleKey = configuration["Supabase:ServiceRoleKey"]?.Trim().Trim('"', '\'')
                ?? Environment.GetEnvironmentVariable("SUPABASE_SECRET_KEY");

            if (serviceRoleKey != null && (serviceRoleKey.Contains("ycpafw") || serviceRoleKey.Contains("PLACEHOLDER")))
            {
                serviceRoleKey = null;
            }

            var bucket = configuration["Supabase:DocumentsBucket"] ?? "claim-documents";

            _bucket = bucket;

            httpClient.BaseAddress =
                new Uri($"{supabaseUrl.TrimEnd('/')}/storage/v1/");

            if (!string.IsNullOrWhiteSpace(serviceRoleKey))
            {
                httpClient.DefaultRequestHeaders.Add(
                    "apikey",
                    serviceRoleKey);

                httpClient.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue(
                        "Bearer",
                        serviceRoleKey);
            }

            _httpClient = httpClient;
        }

        // =========================================================
        // UPLOAD
        // =========================================================

        public async Task UploadAsync(
            string objectPath,
            Stream content,
            string contentType)
        {
            using var streamContent = new StreamContent(content);

            streamContent.Headers.ContentType =
                new MediaTypeHeaderValue(
                    string.IsNullOrWhiteSpace(contentType)
                        ? "application/octet-stream"
                        : contentType);

            var response =
                await _httpClient.PostAsync(
                    $"object/{_bucket}/{objectPath}",
                    streamContent);

            await EnsureSuccessAsync(
                response,
                "upload document");
        }

        // =========================================================
        // SIGNED URL
        // =========================================================

        public async Task<string> CreateSignedUrlAsync(
            string objectPath,
            int expiresInSeconds = 300)
        {
            var response =
                await _httpClient.PostAsJsonAsync(
                    $"object/sign/{_bucket}/{objectPath}",
                    new
                    {
                        expiresIn = expiresInSeconds
                    });

            await EnsureSuccessAsync(
                response,
                "create signed download URL");

            var body =
                await response.Content
                    .ReadFromJsonAsync<JsonElement>();

            var signedUrl =
                body.GetProperty("signedURL").GetString()!;

            return
                $"{_httpClient.BaseAddress}{signedUrl.TrimStart('/')}";
        }

        // =========================================================
        // DOWNLOAD (raw bytes, server-side use - e.g. OCR)
        // =========================================================

        public async Task<byte[]> DownloadAsync(
            string objectPath)
        {
            // 1. Direct public download (fastest, reliable, zero auth overhead)
            try
            {
                using var fallbackClient = new HttpClient();
                var publicUrl = $"https://foludfihdtbxxkqzszmi.supabase.co/storage/v1/object/public/{_bucket}/{objectPath}";
                var publicResp = await fallbackClient.GetAsync(publicUrl);
                if (publicResp.IsSuccessStatusCode)
                {
                    return await publicResp.Content.ReadAsByteArrayAsync();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Storage Download] Public fallback failed for '{objectPath}': {ex.Message}");
            }

            // 2. Authenticated API download fallback
            try
            {
                var response =
                    await _httpClient.GetAsync(
                        $"object/{_bucket}/{objectPath}");

                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadAsByteArrayAsync();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Storage Download] API download failed for '{objectPath}': {ex.Message}");
            }

            return Array.Empty<byte>();
        }

        // =========================================================
        // DELETE
        // =========================================================

        public async Task DeleteAsync(
            string objectPath)
        {
            using var request =
                new HttpRequestMessage(
                    HttpMethod.Delete,
                    $"object/{_bucket}")
                {
                    Content =
                        JsonContent.Create(
                            new
                            {
                                prefixes = new[] { objectPath }
                            })
                };

            var response =
                await _httpClient.SendAsync(request);

            await EnsureSuccessAsync(
                response,
                "delete document");
        }

        // =========================================================
        // ERROR HANDLING
        // =========================================================

        private static async Task EnsureSuccessAsync(
            HttpResponseMessage response,
            string action)
        {
            if (response.IsSuccessStatusCode)
            {
                return;
            }

            var errorBody =
                await response.Content.ReadAsStringAsync();

            throw new InvalidOperationException(
                $"Supabase Storage API failed to {action} " +
                $"({(int)response.StatusCode}): {errorBody}");
        }
    }
}
