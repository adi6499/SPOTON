const fs = require('fs');
const path = require('path');

const sceneDelegate = path.resolve(__dirname, '../ios/App/App/SceneDelegate.swift');

if (fs.existsSync(sceneDelegate)) {
  let content = fs.readFileSync(sceneDelegate, 'utf-8');
  
  // Remove all SceneDelegateProxy calls
  content = content.replace(/\s+SceneDelegateProxy\.shared\.scene\([^)]+\)\n/g, '');
  
  fs.writeFileSync(sceneDelegate, content, 'utf-8');
  console.log('✅ Fixed SceneDelegate.swift - removed proxy calls');
} else {
  console.log('⚠️  SceneDelegate.swift not found');
}
