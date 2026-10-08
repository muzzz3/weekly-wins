import { render } from 'preact';
import { App } from './App.js';
import '../styles.css';

const saved = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', saved);

render(<App />, document.getElementById('root')!);
