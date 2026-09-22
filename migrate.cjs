const fs = require('fs');
const path = require('path');

const OLD = "import { base44 } from '@/api/base44Client';";
const NEW = "import { supabase as base44 } from '@/api/supabaseClient';";

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const fullPath = path.join(dir, f);
    if (fs.statSync(fullPath).isDirectory() && f !== 'node_modules') {
      walk(fullPath);
    } else if (/\.(jsx|js|ts)$/.test(f)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(OLD)) {
        content = content.split(OLD).join(NEW);
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('OK:', f);
      }
    }
  });
}

walk('./src');
console.log('Termine!');
