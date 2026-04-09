import React from 'react';
import { createRoot } from 'react-dom/client';
import { JournalApp } from './components/JournalApp';

const root = createRoot(document.getElementById('root')!);
root.render(<JournalApp />);
