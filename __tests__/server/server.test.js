import request from 'supertest';
import { startServer } from '../../src/server.js';
import http from 'http';

const TEST_PORT = 3456;

describe('Server Health Check', () => {
  let app;
  
  beforeAll(async () => {
    process.env.TEST_PORT = String(TEST_PORT);
    const { app: serverApp, server } = await startServer();
    app = serverApp;
    global.server = server;
  });

  afterAll(async () => {
    if (global.server) {
      global.server.close();
    }
  });

//  test('GET /health should return ok status', async () => {
//    const response = await request(app).get('/health');
//    
//    expect(response.status).toBe(200);
//    expect(response.body).toHaveProperty('status', 'ok');
//    expect(response.body).toHaveProperty('timestamp');
//  });

  test('GET /api/music/search should require query parameter', async () => {
    const response = await request(app).get('/api/music/search');
    
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  test('GET /api/music/search should return valid response with query', async () => {
    const response = await request(app)
      .get('/api/music/search?q=周杰伦&page=1&limit=10&source=tx');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('list');
    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('source');
  }, 30000);
});
