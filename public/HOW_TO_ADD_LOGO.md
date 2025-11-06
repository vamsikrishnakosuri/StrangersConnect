# 🎨 How to Add Your Logo

## Step 1: Prepare Your Logo File

1. Make sure your logo file is saved on your computer
2. The logo should be in PNG format
3. Recommended size: **512x512px** or larger for best quality
4. The logo should have a transparent background OR match your app's background color

## Step 2: Add Logo to Project

1. **Copy your logo file** and rename it to exactly: `logo.png`

2. **Place it in the `public` folder:**
   ```
   Strangers/
   └── public/
       └── logo.png  ← Put your logo here
   ```

3. **That's it!** The logo will automatically appear in:
   - ✅ Header (next to "Strangers Connect" text)
   - ✅ Homepage (large display)
   - ✅ Browser tab (favicon)

## Step 3: Verify It Works

1. Save the file
2. If running locally: The logo should appear immediately when you refresh
3. If deployed: Push to GitHub and Vercel will automatically deploy it

## Troubleshooting

**Logo not showing?**
- Make sure the file is named exactly `logo.png` (lowercase)
- Make sure it's in the `public/` folder (not `public/images/` or anywhere else)
- Check that the file size is reasonable (< 1MB recommended)
- Clear your browser cache and refresh

**Logo looks blurry?**
- Use a higher resolution (512x512px or larger)
- Make sure it's a PNG file, not JPEG

**Logo has wrong background?**
- Use a PNG with transparent background
- Or match the background color to your app's theme

