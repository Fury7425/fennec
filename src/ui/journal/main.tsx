import { createRoot } from 'react-dom/client';
import '../tokens/tokens.css';
import '../shared/shell.css';
import { JournalApp } from './components/JournalApp';

const root = createRoot(document.getElementById('root')!);
root.render(<JournalApp />);
