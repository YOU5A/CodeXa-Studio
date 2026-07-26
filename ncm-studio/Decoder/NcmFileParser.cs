using NcmStudio.Core.Models;

namespace NcmStudio.Core.Decoder;

public static class NcmFileParser
{
    private static readonly byte[] ExpectedMagic = { 0x43, 0x54, 0x45, 0x4E, 0x46, 0x44, 0x41, 0x4D };

    public static NcmFileHeader Parse(Stream stream)
    {
        using var reader = new NcmStreamReader(stream);
        var header = new NcmFileHeader();

        // 1. Read and verify magic
        header.Magic = reader.ReadBytes(8);
        if (!header.Magic.SequenceEqual(ExpectedMagic))
            throw new InvalidDataException("Not a valid NCM file: invalid magic bytes");

        // 2. Skip Gap1 (2 bytes)
        header.Gap1 = reader.ReadBytes(2);

        // 3. Read encrypted key
        header.KeyLength = reader.ReadUInt32();
        header.EncryptedKey = reader.ReadBytes((int)header.KeyLength);

        // 4. Read metadata JSON
        header.MetaLength = reader.ReadUInt32();
        header.MetadataJson = reader.ReadBytes((int)header.MetaLength);

        // 5. Read CRC32
        header.Crc32 = reader.ReadUInt32();

        // 6. Skip Gap2 (5 bytes)
        header.Gap2 = reader.ReadBytes(5);

        // 7. Read cover image
        header.ImageSize = reader.ReadUInt32();
        if (header.ImageSize > 0)
            header.CoverImage = reader.ReadBytes((int)header.ImageSize);
        else
            header.CoverImage = [];

        // 8. Record audio start offset
        header.AudioStartOffset = reader.Position;

        return header;
    }
}
