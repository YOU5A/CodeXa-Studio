namespace NcmStudio.Core.Decoder;

public class NcmStreamReader(Stream stream) : IDisposable
{
    private readonly BinaryReader _reader = new(stream);
    private readonly Stream _stream = stream;

    public byte[] ReadBytes(int count) => _reader.ReadBytes(count);
    public uint ReadUInt32() => _reader.ReadUInt32();
    public long Position => _stream.Position;
    public long Length => _stream.Length;
    public void Dispose() { _reader.Dispose(); _stream.Dispose(); }
}
