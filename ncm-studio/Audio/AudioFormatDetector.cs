namespace NcmStudio.Core.Audio;

public static class AudioFormatDetector
{
    private static readonly byte[] FlacMagic = { 0x66, 0x4C, 0x61, 0x43 }; // "fLaC"
    private static readonly byte[] Id3Magic = { 0x49, 0x44, 0x33 };         // "ID3"

    public static Models.AudioFormat Detect(byte[] header)
    {
        if (header.Length < 4) return Models.AudioFormat.Unknown;
        if (header[0] == FlacMagic[0] && header[1] == FlacMagic[1] &&
            header[2] == FlacMagic[2] && header[3] == FlacMagic[3])
            return Models.AudioFormat.Flac;
        if (header[0] == Id3Magic[0] && header[1] == Id3Magic[1] &&
            header[2] == Id3Magic[2])
            return Models.AudioFormat.Mp3;
        if (header[0] == 0xFF && (header[1] & 0xE0) == 0xE0)
            return Models.AudioFormat.Mp3;
        return Models.AudioFormat.Unknown;
    }
}
