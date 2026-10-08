import { render } from 'preact';
import { FloatingBar } from './FloatingBar.js';
import '../styles.css';

const saved = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', saved);

render(<FloatingBar />, document.getElementById('root')!);
