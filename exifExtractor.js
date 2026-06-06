// exifExtractor.js
const exifr = require('exifr');
const path = require('path');

async function getPhotoMetadata(filePath) {
    try {
        const data = await exifr.parse(filePath);
        if (!data) return null;

        return {
            aperture: data.FNumber ? data.FNumber.toString() : null,
            shutter_speed: data.ExposureTime ? data.ExposureTime.toString() : null,
            iso: data.ISO || null,
            taken_at: data.DateTimeOriginal || null,
            camera_model: data.Model || null,
            focal_35mm: data.FocalLengthIn35mmFormat ? data.FocalLengthIn35mmFormat.toString() : null
        };
    } catch (err) {
        // 🚨 기존 문구와 완전히 다르게 작성하여 변경 여부를 확인합니다.
        const filename = path.basename(filePath);
        console.error(`🔴 [범인확인] 파일명: ${filename} | 에러원인: ${err.message}`);
        return null;
    }
}

module.exports = getPhotoMetadata;