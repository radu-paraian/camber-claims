import os
import pathlib
import dotenv
from google import genai
from google.genai import types

dotenv.load_dotenv('/Users/radu/.gemini/antigravity/scratch/camber_claims/.env.local')
dotenv.load_dotenv('/Users/radu/.gemini/antigravity/scratch/camber_claims/.env')

client = genai.Client()

models = [
    'gemini-3.1-flash-image-preview',
    'gemini-3-pro-image-preview',
    'imagen-4.0-ultra-generate-001',
    'imagen-4.0-generate-001',
    'gemini-2.5-flash-image',
    'imagen-3.0-generate-002'
]

tasks = [
    (
        '/Users/radu/.gemini/antigravity/scratch/camber_claims/frontend/public/thumbnails/case_cheadle_a521.png',
        "Isometric 3D forensic crash reconstruction render of a 4-way UK crossroad junction at night (A521 Huntley Road and Draycott Cross Road). Dark slate studio background (#0b1020), dark charcoal asphalt road surface (#2a2d33) with crisp off-white UK double dashed Give Way markings and lane lines. In the center of the junction, a modern cyan-blue (#0ea5e9) Peugeot 2008 compact SUV emerging northbound is T-boned on its passenger side by an eastbound silver-grey (#cbd5e1) metallic VW Golf hatchback. Glowing neon-red braking trajectory vector trails on the road surface leading to the Golf, glowing cyan trajectory ribbon behind the blue SUV, glowing translucent red-orange circular impact ring at collision point. On the northeast grass verge, a wooden telegraph pole and 30 mph circular speed limit road sign. Sleek 3D Three.js forensic engineering visualization style, ACES Filmic tone mapping, 16:9 aspect ratio, no text."
    ),
    (
        '/Users/radu/.gemini/antigravity/scratch/camber_claims/frontend/public/thumbnails/case_delphouse_rollover.png',
        "Isometric 3D forensic crash reconstruction render of a rural UK crossroad junction at night. Dark slate studio background (#0b1020), dark charcoal asphalt road surface (#2a2d33) with crisp off-white UK Give Way markings and dashed center lines. A white Ford Puma SUV overshooting the Give Way line is struck on the flank by a dark grey metallic BMW 320d saloon on the priority road. Glowing orange impact ring, glowing cyan and red trajectory vector paths on the road surface, Three.js forensic engineering visualization style, ACES Filmic lighting, 16:9 aspect ratio, no text."
    ),
    (
        '/Users/radu/.gemini/antigravity/scratch/camber_claims/frontend/public/thumbnails/case_a521_hgv.png',
        "Isometric 3D forensic crash reconstruction render of a UK single-carriageway corridor at night. Dark slate studio background (#0b1020), dark charcoal asphalt road surface (#2a2d33) with crisp off-white UK hazard warning lines. A large articulated HGV lorry with white cab and silver trailer encroaches across the center line, colliding with an oncoming crimson-red compact hatchback. Glowing forensic braking zone and red trajectory vectors on dark asphalt, glowing amber impact ring, Three.js forensic engineering visualization style, ACES Filmic tone mapping, 16:9 aspect ratio, no text."
    ),
]

for out_path, prompt in tasks:
    pathlib.Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    print(f"Generating for {os.path.basename(out_path)}...")
    generated = False
    for m in models:
        try:
            print(f"  Trying model {m}...")
            if m.startswith('gemini-'):
                res = client.models.generate_content(
                    model=m,
                    contents=prompt,
                    config=types.GenerateContentConfig(response_modalities=['IMAGE'])
                )
                img_data = None
                for cand in res.candidates:
                    for part in cand.content.parts:
                        if part.inline_data and part.inline_data.data:
                            img_data = part.inline_data.data
                            break
                    if img_data:
                        break
                if img_data:
                    with open(out_path, 'wb') as f:
                        f.write(img_data)
                    sz = os.path.getsize(out_path)
                    print(f"  Success with {m}! Saved {sz} bytes to {out_path}")
                    generated = True
                    break
            else:
                res = client.models.generate_images(
                    model=m,
                    prompt=prompt,
                    config=types.GenerateImagesConfig(number_of_images=1, aspect_ratio="16:9")
                )
                if res.generated_images and res.generated_images[0].image.image_bytes:
                    img_data = res.generated_images[0].image.image_bytes
                    with open(out_path, 'wb') as f:
                        f.write(img_data)
                    sz = os.path.getsize(out_path)
                    print(f"  Success with {m}! Saved {sz} bytes to {out_path}")
                    generated = True
                    break
        except Exception as e:
            print(f"  Error with {m}: {type(e).__name__}: {e}")

    if not generated:
        raise RuntimeError(f"Failed to generate {out_path} with all models.")

print("All thumbnails generated successfully!")
