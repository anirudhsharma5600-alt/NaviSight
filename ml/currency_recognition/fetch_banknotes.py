import os
import json
import urllib.request

RAW_DIR = os.path.join(os.path.dirname(__file__), 'raw_samples')
os.makedirs(RAW_DIR, exist_ok=True)

SAMPLES = {
    '10_obverse.jpg': 'https://upload.wikimedia.org/wikipedia/commons/7/7c/India_new_10_INR%2C_MG_series%2C_2018%2C_obverse.jpg',
    '10_reverse.jpg': 'https://upload.wikimedia.org/wikipedia/commons/b/b5/India_new_10_INR%2C_MG_series%2C_2018%2C_reverse.jpg',
    '20_obverse.jpg': 'https://upload.wikimedia.org/wikipedia/commons/5/53/India_new_20_INR%2C_MG_series%2C_2019%2C_obverse.jpg',
    '20_reverse.jpg': 'https://upload.wikimedia.org/wikipedia/commons/e/ea/India_new_20_INR%2C_MG_series%2C_2019%2C_reverse.jpg',
    '50_obverse.jpg': 'https://upload.wikimedia.org/wikipedia/commons/3/3f/India_new_50_INR%2C_MG_series%2C_2018%2C_obverse.jpg',
    '50_reverse.jpg': 'https://upload.wikimedia.org/wikipedia/commons/6/62/India_new_50_INR%2C_MG_series%2C_2018%2C_reverse.jpg',
    '100_obverse.png': 'https://upload.wikimedia.org/wikipedia/commons/8/88/India_new_100_INR%2C_Mahatma_Gandhi_New_Series%2C_2018%2C_obverse.png',
    '100_reverse.png': 'https://upload.wikimedia.org/wikipedia/commons/d/d3/India_new_100_INR%2C_Mahatma_Gandhi_New_Series%2C_2018%2C_reverse.png',
    '200_obverse.jpg': 'https://upload.wikimedia.org/wikipedia/commons/f/fa/India%2C_200_INR%2C_2018%2C_obverse.jpg',
    '200_reverse.jpg': 'https://upload.wikimedia.org/wikipedia/commons/9/9e/India%2C_200_INR%2C_2018%2C_reverse.jpg',
    '500_obverse.jpg': 'https://upload.wikimedia.org/wikipedia/commons/2/2e/India_new_500_INR%2C_MG_series%2C_2016%2C_obverse.jpg',
    '500_reverse.jpg': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/India_new_500_INR%2C_MG_series%2C_2016%2C_reverse.jpg',
    '2000_obverse.jpg': 'https://upload.wikimedia.org/wikipedia/commons/0/07/India_new_2000_INR%2C_MG_series%2C_2016%2C_obverse.jpg',
    '2000_reverse.jpg': 'https://upload.wikimedia.org/wikipedia/commons/a/ad/India_new_2000_INR%2C_MG_series%2C_2016%2C_reverse.jpg'
}

def main():
    headers = {'User-Agent': 'NaviAbleAI-Research/1.0 (currency-study; contact@naviable.ai)'}
    for fname, url in SAMPLES.items():
        dest = os.path.join(RAW_DIR, fname)
        if os.path.exists(dest) and os.path.getsize(dest) > 1000:
            print(f"[EXISTS] {fname}")
            continue
        print(f"[DOWNLOADING] {fname} from {url}...")
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp, open(dest, 'wb') as out_f:
            out_f.write(resp.read())
        print(f"[SAVED] {fname} ({os.path.getsize(dest)} bytes)")

if __name__ == '__main__':
    main()

