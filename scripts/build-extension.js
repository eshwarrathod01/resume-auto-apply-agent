// Build script for Chrome extension
// Creates a distributable zip file

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const extensionDir = path.join(__dirname, '..', 'extension');
const distDir = path.join(__dirname, '..', 'dist');
const outputFile = path.join(distDir, 'resume-auto-apply-extension.zip');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Files to include in the extension
const filesToInclude = [
  'manifest.json',
  'background.js',
  'content-scripts/**/*',
  'popup/**/*',
  'styles/**/*',
  'icons/**/*'
];

console.log('Building Chrome extension...');

// Check if required files exist
const requiredFiles = [
  'manifest.json',
  'background.js',
  'popup/popup.html',
  'popup/popup.js',
  'popup/popup.css'
];

let missingFiles = [];
for (const file of requiredFiles) {
  const filepath = path.join(extensionDir, file);
  if (!fs.existsSync(filepath)) {
    missingFiles.push(file);
  }
}

if (missingFiles.length > 0) {
  console.error('Missing required files:');
  missingFiles.forEach(f => console.error(`  - ${f}`));
  process.exit(1);
}

// Create icons if they don't exist
const iconSizes = [16, 32, 48, 128];
const iconsDir = path.join(extensionDir, 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

for (const size of iconSizes) {
  const iconPath = path.join(iconsDir, `icon${size}.png`);
  if (!fs.existsSync(iconPath)) {
    console.log(`Warning: Missing icon${size}.png - creating placeholder`);
    // Create empty placeholder
    fs.writeFileSync(iconPath, Buffer.alloc(1));
  }
}

// On Windows, use PowerShell to create zip
// On Unix, use zip command
try {
  if (process.platform === 'win32') {
    // PowerShell command to create zip
    const psCommand = `
      $source = "${extensionDir.replace(/\\/g, '/')}"
      $destination = "${outputFile.replace(/\\/g, '/')}"
      if (Test-Path $destination) { Remove-Item $destination }
      Compress-Archive -Path "$source/*" -DestinationPath $destination
    `;
    execSync(`powershell -Command "${psCommand}"`, { stdio: 'inherit' });
  } else {
    // Unix zip command
    execSync(`cd "${extensionDir}" && zip -r "${outputFile}" .`, { stdio: 'inherit' });
  }
  
  console.log(`\nExtension built successfully: ${outputFile}`);
  console.log('\nTo install:');
  console.log('1. Open Chrome and go to chrome://extensions/');
  console.log('2. Enable "Developer mode"');
  console.log('3. Click "Load unpacked" and select the extension folder');
  console.log('   OR drag the zip file to the extensions page');
  
} catch (error) {
  console.error('Failed to create zip file:', error.message);
  console.log('\nAlternatively, manually zip the extension folder for distribution.');
  process.exit(1);
}
