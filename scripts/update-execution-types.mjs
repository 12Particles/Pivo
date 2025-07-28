import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const importMappings = [
  // Replace imports from useExecutionStore to types/execution
  {
    from: /import\s*{\s*([^}]*UnifiedMessage[^}]*)\s*}\s*from\s*['"]@\/stores\/useExecutionStore['"]/g,
    to: (match, imports) => `import { ${imports} } from '@/types/execution'`
  },
  {
    from: /import\s*{\s*([^}]*UnifiedMessageType[^}]*)\s*}\s*from\s*['"]@\/stores\/useExecutionStore['"]/g,
    to: (match, imports) => `import { ${imports} } from '@/types/execution'`
  },
  {
    from: /import\s*{\s*([^}]*SystemMessageLevel[^}]*)\s*}\s*from\s*['"]@\/stores\/useExecutionStore['"]/g,
    to: (match, imports) => `import { ${imports} } from '@/types/execution'`
  },
  {
    from: /import\s*{\s*([^}]*AttemptExecutionState[^}]*)\s*}\s*from\s*['"]@\/stores\/useExecutionStore['"]/g,
    to: (match, imports) => `import { ${imports} } from '@/types/execution'`
  },
  {
    from: /import\s*{\s*([^}]*TaskExecutionSummary[^}]*)\s*}\s*from\s*['"]@\/stores\/useExecutionStore['"]/g,
    to: (match, imports) => `import { ${imports} } from '@/types/execution'`
  }
];

async function* getFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'dist', 'target'].includes(entry.name)) {
        yield* getFiles(fullPath);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      yield fullPath;
    }
  }
}

async function updateImports() {
  const srcDir = './src';
  let updatedFiles = 0;
  const updatedFilesList = [];
  
  for await (const file of getFiles(srcDir)) {
    // Skip the useExecutionStore.ts file itself
    if (file.includes('useExecutionStore.ts')) continue;
    
    let content = await readFile(file, 'utf-8');
    let modified = false;
    
    for (const mapping of importMappings) {
      const newContent = content.replace(mapping.from, mapping.to);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    }
    
    if (modified) {
      await writeFile(file, content);
      updatedFilesList.push(file);
      updatedFiles++;
    }
  }
  
  console.log('Updated files:');
  updatedFilesList.forEach(file => console.log(`  ${file}`));
  console.log(`\nTotal files updated: ${updatedFiles}`);
}

updateImports().catch(console.error);