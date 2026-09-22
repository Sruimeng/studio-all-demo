import { defineConfig } from '@tripo3d/design/config';

export default defineConfig({
  rules: [
    ['bg-checkerboard', {
      'background-image': 'conic-gradient(rgb(0 0 0 / 23.92%) 25%, rgb(54 54 54 / 23.92%) 0 50%, rgb(0 0 0 / 23.92%) 0 75%, rgb(54 54 54 / 23.92%) 0)',
      'background-position': '0 0',
      'background-repeat': 'repeat',
      'background-size': '1.50338rem 1.50338rem',
    }],
  ],
  theme: {
    colors: {
      purple: { 4: '#5C54ED' },
      uv: { face: '#F2F2F2', ink: '#020202', wire: '#C4C4C4' },
    },
  },
});
