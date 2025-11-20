import { createServer, Server as HTTPServer } from 'http';
import app from './app';
import seedSuperAdmin from './app/DB';
import config from './config';
import { Server } from 'socket.io';
import { initSocket } from './app/utils/socket';
import { customConsole } from './app/utils/customConsole';
const port = config.port || 5000;

async function main() {
  const server: HTTPServer = createServer(app).listen(port, () => {
    customConsole(port, 'Initial Project (Server)')
    seedSuperAdmin();
  });



  const io = initSocket(server);

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.on('register', (userId: string) => {
      socket.join(userId);
      console.log(`User ${userId} joined their personal room`);
    })
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  const exitHandler = () => {
    if (server) {
      server.close(() => {
        console.info('Server closed!');
      });
    }
    process.exit(1);
  };

  process.on('uncaughtException', error => {
    console.log(error);
    exitHandler();
  });

  process.on('unhandledRejection', error => {
    console.log(error);
    exitHandler();
  });
}

main();
