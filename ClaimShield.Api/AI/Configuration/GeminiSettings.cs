namespace ClaimShield.Api.AI.Configuration
{
    public class GeminiSettings
    {
        public string ApiKey { get; set; } = string.Empty;

        public string Model { get; set; } = "gemini-3.5-flash";

        public string Endpoint { get; set; } = "https://generativelanguage.googleapis.com/v1beta/models";

        public float Temperature { get; set; } = 0.3f;
    }
}
