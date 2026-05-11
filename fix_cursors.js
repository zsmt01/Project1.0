const fs = require('fs');
const files = [
    'c:/Users/etulyon1/Documents/mom-training-app/src/app/cdash/page.tsx',
    'c:/Users/etulyon1/Documents/mom-training-app/src/app/adash/page.tsx'
];

files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');

    function fixTags(tagName) {
        let regex = new RegExp(`<${tagName}([^>]+)className=["\'](.*?)["\']`, 'g');
        content = content.replace(regex, (match, prefix, cls) => {
            if (!cls.includes('cursor-pointer')) {
                return `<${tagName}${prefix}className="cursor-pointer ${cls}"`;
            }
            return match;
        });

        let regex2 = new RegExp(`<${tagName}([^>]+)className=\\{\\`([\\s\\S] *?) \\`\\}`, 'g');
        content = content.replace(regex2, (match, prefix, cls) => {
            if (!cls.includes('cursor-pointer')) {
                return `<${tagName}${prefix}className={\`cursor-pointer ${cls}\`}`;
            }
            return match;
        });
    }

    fixTags('button');
    fixTags('a');
    fixTags('Link');

    let divRegex = /<div([^>]+onClick=[^>]+className=["\'](.*?)["\'])/g;
    content = content.replace(divRegex, (match, inside, cls) => {
        if (!cls.includes('cursor-pointer')) {
            return match.replace(cls, 'cursor-pointer ' + cls);
        }
        return match;
    });

    fs.writeFileSync(f, content, 'utf8');
});

console.log("Fixed files");
