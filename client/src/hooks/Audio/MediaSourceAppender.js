export class MediaSourceAppender {
    mediaSource = new MediaSource();
    audioChunks = [];
    sourceBuffer;
    constructor(type) {
        this.mediaSource.addEventListener('sourceopen', async () => {
            this.sourceBuffer = this.mediaSource.addSourceBuffer(type);
            this.sourceBuffer.addEventListener('updateend', () => {
                this.tryAppendNextChunk();
            });
        });
    }
    tryAppendNextChunk() {
        if (this.sourceBuffer != null && !this.sourceBuffer.updating && this.audioChunks.length > 0) {
            this.sourceBuffer.appendBuffer(this.audioChunks.shift());
        }
    }
    addBase64Data(base64Data) {
        this.addData(Uint8Array.from(atob(base64Data), (char) => char.charCodeAt(0)).buffer);
    }
    addData(data) {
        this.audioChunks.push(data);
        this.tryAppendNextChunk();
    }
    close() {
        if (this.mediaSource.readyState === 'open') {
            this.mediaSource.endOfStream();
        }
    }
    get mediaSourceUrl() {
        return URL.createObjectURL(this.mediaSource);
    }
}
