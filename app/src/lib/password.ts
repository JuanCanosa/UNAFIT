const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';

export function gerarSenha(len = 12): string {
  return Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}
