import os
import shutil
import numpy as np
from PIL import Image
from scipy.ndimage import label

BASE_DIR = os.path.abspath('energia_sur_frontend/public/assets/lumi/safety')

def get_outer_background(arr):
    rgb = arr[:, :, :3]
    whiteness = np.min(rgb, axis=2)
    is_white = whiteness > 230
    labeled, _ = label(is_white)
    border_labels = set(np.unique(np.concatenate([
        labeled[0, :], labeled[-1, :], labeled[:, 0], labeled[:, -1]
    ])))
    if 0 in border_labels:
        border_labels.remove(0)
    return np.isin(labeled, list(border_labels))

def recolor_text_alpha_matte(arr, alpha, y1, y2, x1, x2, target_color=(255, 255, 255), max_sat=45):
    sub_rgb = arr[y1:y2, x1:x2, :3]
    sub_alpha = alpha[y1:y2, x1:x2]
    
    sat = np.max(sub_rgb, axis=2) - np.min(sub_rgb, axis=2)
    diff = 255.0 - sub_rgb
    c_text = np.array([17.0, 38.0, 67.0], dtype=np.float32)
    max_diff = 255.0 - c_text
    
    alpha_ch = np.clip(diff / max_diff, 0.0, 1.0)
    text_cov = np.mean(alpha_ch, axis=2)
    
    text_mask = (text_cov > 0.08) & (sat < max_sat)
    
    for c in range(3):
        sub_rgb[:, :, c] = np.where(text_mask, target_color[c], sub_rgb[:, :, c])
    
    sub_alpha[:] = np.where(text_mask, np.maximum(sub_alpha, text_cov * 255.0), sub_alpha)
    return text_mask

def process_file(filename):
    src = os.path.join(BASE_DIR, filename.replace('.png', '.original.png'))
    im = Image.open(src).convert('RGBA')
    arr = np.array(im, dtype=np.float32)
    h, w, _ = arr.shape
    alpha = arr[:, :, 3]
    
    outer_bg = get_outer_background(arr)
    recolored = np.zeros((h, w), dtype=bool)
    
    # 1. Top Logo (common to all 3)
    # 'EnergIA Sur': y: 15-80, x: 380-720
    m_logo1 = recolor_text_alpha_matte(arr, alpha, 15, 80, 380, 720, target_color=(255, 255, 255))
    recolored[15:80, 380:720] |= m_logo1
    
    # 'Un producto de FORZA TECH': y: 78-115, x: 350-700
    m_logo2 = recolor_text_alpha_matte(arr, alpha, 78, 115, 350, 700, target_color=(180, 205, 230))
    recolored[78:115, 350:700] |= m_logo2
    
    if filename == 'alta-potencia.png':
        # 'La zapatilla no es para equipos de alta potencia.'
        # y: 340-520, x: 720-1080
        m_zap = recolor_text_alpha_matte(arr, alpha, 340, 520, 720, 1080, target_color=(255, 255, 255))
        recolored[340:520, 720:1080] |= m_zap
        
        # 'Respetá la potencia máxima indicada...'
        # y: 1330-1402, x: 100-1050
        m_resp = recolor_text_alpha_matte(arr, alpha, 1330, 1402, 100, 1050, target_color=(255, 255, 255))
        recolored[1330:1402, 100:1050] |= m_resp

    # Make outer background transparent, except where text was recolored
    whiteness = np.min(arr[:, :, :3], axis=2)
    bg_clear = outer_bg & (~recolored)
    
    alpha[bg_clear & (whiteness >= 244)] = 0.0
    blend = bg_clear & (whiteness >= 215) & (whiteness < 244)
    alpha[blend] = ((244.0 - whiteness[blend]) / 29.0) * alpha[blend]
    
    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), mode='RGBA')
    dest = os.path.join(BASE_DIR, filename)
    out.save(dest, format='PNG', optimize=True)
    print(f'Processed and saved {filename} as transparent PNG.')
    
    # Save preview on dark background #131b26
    dark = Image.new('RGBA', (w, h), (19, 27, 38, 255))
    preview = Image.alpha_composite(dark, out)
    preview.thumbnail((450, 560))
    preview_name = 'preview_dark_' + filename.replace('.png', '.jpg')
    preview.convert('RGB').save(preview_name)
    print(f'Saved {preview_name}')

if __name__ == '__main__':
    for f in ['alta-potencia.png', 'sujetar-ficha.png', 'sin-cadenas.png']:
        process_file(f)
