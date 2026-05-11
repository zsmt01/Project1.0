const fs = require('fs');

const files = [
    'c:/Users/etulyon1/Documents/mom-training-app/src/app/cdash/page.tsx',
    'c:/Users/etulyon1/Documents/mom-training-app/src/app/adash/page.tsx'
];

files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    
    // Add cursor-pointer to button tags that have className="..." but don't already have cursor-pointer
    content = content.replace(/(<button[^>]*?className=")((?!.*cursor-pointer).*)(")/g, '$1cursor-pointer $2$3');
    
    // Add it to the calendar days specific logic in cdash/page.tsx
    content = content.replace(
        "isSelected ? 'bg-blue-600 text-white shadow-md scale-105' : 'hover:bg-blue-50 text-gray-700'",
        "isSelected ? 'bg-blue-600 text-white shadow-md scale-105 cursor-pointer' : 'hover:bg-blue-50 text-gray-700 cursor-pointer'"
    );

    fs.writeFileSync(f, content, 'utf8');
});

console.log('Done!');
