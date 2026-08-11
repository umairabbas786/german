// capture-processor.js
class CaptureProcessor extends AudioWorkletProcessor {
    process(inputs) {
      const input = inputs[0];
      if (input && input.length > 0) {
        const channelData = input[0];
        
        // 'sampleRate' is a global variable inside the Worklet scope 
        // representing the hardware's actual rate!
        const downsampled = this.downsample(channelData, sampleRate, 16000);
        const int16Data = this.floatTo16BitPCM(downsampled);
        
        this.port.postMessage(int16Data.buffer, [int16Data.buffer]);
      }
      return true;
    }

  downsample(buffer, fromRate, toRate) {
    const ratio = fromRate / toRate;
    const newLength = Math.floor(buffer.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      result[i] = buffer[Math.floor(i * ratio)];
    }
    return result;
  }

  floatTo16BitPCM(float32Array) {
    const buffer = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return buffer;
  }
}

registerProcessor('capture-processor', CaptureProcessor);
