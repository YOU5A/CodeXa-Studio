namespace NcmStudio.Core.Models;

public class NcmFileHeader
{
    public static readonly byte[] ExpectedMagic = { 0x43, 0x54, 0x45, 0x4E, 0x46, 0x44, 0x41, 0x4D };
    public byte[] Magic { get; set; } = [];
    public byte[] Gap1 { get; set; } = [];
    public uint KeyLength { get; set; }
    public byte[] EncryptedKey { get; set; } = [];
    public uint MetaLength { get; set; }
    public byte[] MetadataJson { get; set; } = [];
    public uint Crc32 { get; set; }
    public byte[] Gap2 { get; set; } = [];
    public uint ImageSize { get; set; }
    public byte[] CoverImage { get; set; } = [];
    public long AudioStartOffset { get; set; }
}
