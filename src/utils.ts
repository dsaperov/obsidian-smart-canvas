export function getRandomId(e: number): string {
    let t = [];
    for (let n = 0; n < e; n++) {
        t.push((16 * Math.random() | 0).toString(16));
    }
    return t.join('')
}

export function hexToRgb(hex: string): string {
    hex = hex.replace(/^#/, '');
    
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    
    return `${r},${g},${b}`;
}