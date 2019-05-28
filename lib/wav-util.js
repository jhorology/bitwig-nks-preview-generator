const fs = require('fs'),
      {promisify} = require('util');

/**
 * validate & read .wav file
 * @function
 * @param {String} file - .wav file path
 * @return {Promise} - resolve Buffer
 */
async function validateRead(file) {
  const wav = await _readWav(file, true, true);
  // rewrite RIFF content size
  wav.header.buffer.writeUInt32LE(wav.fmt.length + wav.data.length + 4, 4);
  return Buffer.concat([
    wav.header.buffer,
    wav.fmt.buffer,
    wav.data.buffer
  ]);
};

/**
 * read & parse fmt chunk & data size
 * @function
 * @param {String} file - .wav file path
 * @return {Promise} - resolve {Object} wav format
 */
async function readFormat(file) {
  const wav = await _readWav(file, true, false);
  return {
    audioFormat: wav.fmt.buffer.readUInt16LE(8),
    numChannels: wav.fmt.buffer.readUInt16LE(10),
    sampleRate: wav.fmt.buffer.readUInt32LE(12),
    byteRate: wav.fmt.buffer.readUInt32LE(16),
    blockAlign: wav.fmt.buffer.readUInt16LE(20),
    bitsPerSample: wav.fmt.buffer.readUInt16LE(22),
    dataSize: wav.data.size
  };
}

async function _readWav(file, readFmtContent, readDataContent) {
  const fd = await promisify(fs.open)(file);
  try {
    const header = await _header(fd, 'WAVE'),
          fileSize = header.size + 8,
          subscribes = [];
    if (readFmtContent) subscribes.push('fmt ');
    if (readDataContent) subscribes.push('data');
    var position = 12,
        fmtChunk, dataChunk;
    while (position < fileSize) {
      const chunk = await _chunk(fd, position, subscribes);
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
    return {
      header: header,
      fmt: fmtChunk,
      data: dataChunk
    };
  } finally {
    await promisify(fs.close)(fd);
  }
}

async function _header(fd, expectFormType) {
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
  if (formType !== expectFormType) {
    throw new Error('unknown header formType:' + formType);
  }
  return {
    id: id,
    size: size,
    formType: formType,
    buffer: buffer
  };
}

async function _chunk(fd, position, subscribeIds) {
  const buffer = await _read(fd, 8, position),
        id =  buffer.toString('ascii', 0, 4),
        size = buffer.readUInt32LE(4),
        contentLength = (size + 1) & ~1,
        ret = {
          id: id,
          size: size,
          length: contentLength + 8,  // id + size + content
        };
  if (subscribeIds && subscribeIds.includes(id)) {
    ret.buffer = Buffer.concat([
      buffer,
      await _read(fd, contentLength, position + 8)
    ]);
  }
  return ret;
}

async function _read(fd, length, position) {
  const buffer = Buffer.alloc(length);
  const ret = await promisify(fs.read)(fd, buffer, 0, length, position);
  if (ret.bytesRead !== length) {
    throw new Error(`wrong bytesRead. expect lengt:${length} bytesRead:${ret.bytesRead}`);
  }
  return buffer;
}

module.exports = {
  validateRead: validateRead,
  readFormat: readFormat
};
