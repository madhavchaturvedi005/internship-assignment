const net = require('net');

const client = net.connect(5001, 'localhost', () => {
  console.log('Connected to TCP server');
  client.write('PING,354678901234561,18.5204,73.8567,42.5,2\n');
  setTimeout(() => {
    client.destroy();
    console.log('Done');
  }, 500);
});

client.on('error', (err) => {
  console.error('TCP error:', err.message);
});
