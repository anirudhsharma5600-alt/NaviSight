# Work block 0 — pehla test, bilkul basic steps

Is test ke liye **phone ya glasses nahi chahiye**. Isse sirf local evaluation page, image labeling, detector run, aur results file download check honge. Is test se object detector ki accuracy pass/fail declare nahi hogi.

## A. Local website start karo

1. Antigravity ke terminal mein dekho: agar `VITE ... ready` aur `Local: http://127.0.0.1:5173/` pehle se likha hai, server chal raha hai. **Dobara start mat karo**; terminal khula rehne do.
2. Agar server nahi chal raha, Antigravity terminal mein yeh exact command likho:

   ```powershell
   .\start-navi-dev.cmd
   ```

   Is command mein `npm` ki zaroorat nahi. `VITE ... ready` aane ke baad terminal band mat karo.

## B. Main page se evaluation page par jao

Video mein main page khula tha: `http://127.0.0.1:5173/`. Evaluation tool usse alag route hai.

1. Browser ke sabse upar address bar par click karo, ya `Ctrl+L` dabao.
2. Purana address select hoga. Yeh poora address type/paste karo aur Enter dabao:

   ```text
   http://127.0.0.1:5173/model-evaluation
   ```

3. **Object model evaluation set** heading aane mein kuch seconds lag sakte hain. Location permission popup aaye to **Allow mat karo**—is test ko location nahi chahiye. Address bar mein upar wala route khol do.

## C. Do sample photos chuno

1. **Choose local images** button dabao.
2. File picker mein project ka `test_assets` folder kholo:

   ```text
   C:\Users\ABC\Desktop\Navi AI\test_assets
   ```

3. `cat.jpg` par click karo, phir `Ctrl` daba kar `bus.jpg` par click karo. Dono select ho jaayen to **Open** dabao. Agar multi-select mushkil lage, pehle sirf `cat.jpg` se shuru kar sakti ho.
4. **Split** ko `Validation` hi rehne do. Device field mein sach likho, jaise `Windows laptop + Antigravity browser`. Android phone ka naam mat likho—yeh laptop check hai.

## D. Photo par box aur label banao

1. Cat wali photo khuli hogi. Right side ke **Ground-truth class** box mein `cat` likho.
2. Photo par mouse daba kar rakho aur poori billi ke aas-paas ek rectangle banao—kaan se lekar body/paws tak. Mouse chhodne par hara box aur `cat` label dikhna chahiye.
3. **Human labels** ke neeche wala checkbox tick karo: `I reviewed this whole image...`
4. Neeche `bus.jpg` thumbnail par click karo. Class box mein `bus` likho aur photo mein poore bus ke aas-paas rectangle drag karo. Is image ka reviewed checkbox bhi tick karo.

Box galat ban jaaye to us label ke paas **Remove** dabao, phir sahi box dobara draw karo.

## E. Model chalao aur results file save karo

1. **Run model on all images** dabao.
2. Pehli baar `Loading detector model…` dikh sakta hai; thoda wait karo. Uske baad `Running model 1/2…` aur `2/2…` progress aayegi. Internet chahiye ho sakta hai kyunki detector ke weights pehli baar download honge.
3. AI ke boxes cyan/neele aur tumhare labels hare dikhte hain. Agar AI galat object bole, note kar lena—yeh accuracy test ke liye useful observation hai. **Is pehle step ka pass sirf itna hai ki workflow bina error ke chala.**
4. **Download evaluation JSON** dabao. Isse ek chhoti results file Downloads folder mein save hogi; yeh photo nahi hai. Abhi usse kholne, edit karne, ya upload karne ki zaroorat nahi.

## Mujhe kya report karna hai

- **Pass:** evaluation page khuli, dono photos par box/label bana, model run hua, aur JSON file download hui.
- **Fail:** jo step ruka uska screenshot bhejo; agar terminal mein laal error hai to uska photo/text bhi bhejo.

Pass hone par main agla feature apne aap shuru nahi karunga—pehle tumse permission loonga. Fail hone par isi Work block 0 ko theek karenge.
