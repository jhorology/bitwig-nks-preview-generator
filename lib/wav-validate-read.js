const fs = require('fs'),
      {promisify} = require('util');

/**
 * validate & read .wav file
 * @param {String} file - .wav file path
 * @return {Promise} - resolve Buffer
 */
module.exports = async (file) => {
  const fd = await promisify(fs.open)(file);
  try {
    const header = await _header(fd),
          fileSize = header.size + 8,
          ids = [];
    var position = 12,
        fmtChunk, dataChunk;
    while (position < fileSize) {
      const chunk = await _chunk(fd, position);
      if (chunk.id === 'fmt ')  fmtChunk = chunk;
      if (chunk.id === 'data')  dataChunk = chunk;
      position += chunk.length;
    }
    if (!fmtChunk) {
      throw new Error('[fmt ] chunk not included.');
    }
    if (!dataChunk) {
      throw new Error('[data] chunk not included');
    }
    header.buffer.writeUInt32LE(fmtChunk.length + dataChunk.length + 4, 4);
    return Buffer.concat([
      header.buffer,
      fmtChunk.buffer,
      dataChunk.buffer
    ]);
  } finally {
    await promisify(fs.close)(fd);
  }
};

async function _header(fd) {
  const buffer = await _read(fd, 12, 0),
        id = buffer.toString('ascii', 0, 4);
  if (id !== 'RIFF') {
    throw new Error('unknown magic id:' + id);
  }
  // formType 4 bytes
  // 'fmt ' (minimum 8 bytes)
  // 'data' (minumum 8 bytes)
  const size = buffer.readUInt32LE(4);
  if (size < 20) {
    throw new Error('header size:' + size);
  }
  const formType = buffer.toString('ascii', 8, 12);
  if (formType !== 'WAVE') {
    throw new Error('unknown header formType:' + formType);
  }
  return {
    id: id,
    size: size,
    formType: formType,
    buffer: buffer
  };
}

async function _chunk(fd, position) {
  const buffer = await _read(fd, 8, position),
        id =  buffer.toString('ascii', 0, 4),
        size = buffer.readUInt32LE(4),
        contentLength = (size + 1) & ~1,
        ret = {
          id: id,
          length: contentLength + 8,  // id + size + content
        };
  if (id === 'fmt ' || id === 'data') {
    ret.buffer = Buffer.concat([
      buffer,
      await _read(fd, contentLength, position + 8)
    ]);
  }
  return ret;
}

async function _read(fd, length, position) {
  const buffer = Buffer.alloc(length),
        ret = await promisify(fs.read)(fd, buffer, 0, length, position);
  if (ret.bytesRead !== length) {
    throw new Error(`wrong bytesRead. expect lengt:${length} bytesRead:${ret.bytesRead}`);
  }
  return buffer;
}
