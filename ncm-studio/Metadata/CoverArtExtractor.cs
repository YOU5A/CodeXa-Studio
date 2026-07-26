namespace NcmStudio.Core.Metadata;

public static class CoverArtExtractor
{
    private static readonly byte[] JpegMagic = { 0xFF, 0xD8, 0xFF };
    private static readonly byte[] PngMagic = { 0x89, 0x50, 0x4E, 0x47 };

    public static string DetectMimeType(byte[] data)
    {
        if (data.Length >= 3 &&
            data[0] == JpegMagic[0] && data[1] == JpegMagic[1] && data[2] == JpegMagic[2])
            return "image/jpeg";
        if (data.Length >= 4 &&
            data[0] == PngMagic[0] && data[1] == PngMagic[1] &&
            data[2] == PngMagic[2] && data[3] == PngMagic[3])
            return "image/png";
        return "image/jpeg"; // fallback
    }
}