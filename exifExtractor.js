const fs = require('fs');
const exifParser = require('exif-parser');
const path = require('path');

async function getPhotoMetadata(filePath) {
    try {
        const buffer = fs.readFileSync(filePath);
        const parser = exifParser.create(buffer);
        const result = parser.parse();
        const tags = result.tags;
        
        let takenAt = null;
        if (tags.DateTimeOriginal) {
            let d;
            if (typeof tags.DateTimeOriginal === 'number') {
                d = new Date(tags.DateTimeOriginal * 1000);
            } else {
                d = new Date(tags.DateTimeOriginal);
            }

            if (d instanceof Date && !isNaN(d)) {
                // [핵심] 한국 시간(KST)은 UTC+9 이므로, 9시간(32,400,000ms)을 빼서 저장한다.
                // 이렇게 하면 DB가 UTC로 저장하더라도 나중에 꺼낼 때 딱 맞게 됨.
                d.setTime(d.getTime() - (9 * 60 * 60 * 1000));
                
                takenAt = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
            }
        }
        
        return {
            aperture: tags.FNumber ? tags.FNumber.toString() : null,
            shutter_speed: tags.ExposureTime ? tags.ExposureTime.toString() : null,
            iso: tags.ISO ? tags.ISO.toString() : null,
            taken_at: takenAt,
            camera_model: tags.Model || null,
            focal_35mm: tags.FocalLength ? tags.FocalLength.toString() : null
        };
    } catch (err) {
        const logMessage = `🔴 파싱 실패: ${path.basename(filePath)} | 이유: ${err.message}\n`;
        fs.appendFile('my-node-out.log', logMessage, (logErr) => {});
        return null;
    }
}

module.exports = getPhotoMetadata;