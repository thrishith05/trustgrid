# CivicFix Backend API

RESTful API for the CivicFix civic issue reporting system.

## Features

- **Report Management**: Create, read, update, and delete civic issue reports
- **File Upload**: Handle image uploads with validation
- **Duplicate Detection**: Check for similar reports using perceptual hashing
- **Statistics**: Provide analytics and reporting data
- **Department Management**: Manage municipal departments
- **Rate Limiting**: Prevent API abuse
- **CORS Support**: Enable cross-origin requests

## API Endpoints

### Reports
- `GET /api/reports` - Get all reports (with filtering)
- `GET /api/reports/:id` - Get specific report
- `POST /api/reports` - Create new report (with image upload)
- `PATCH /api/reports/:id/status` - Update report status

### Duplicates
- `POST /api/duplicates` - Check for duplicate reports

### Statistics
- `GET /api/stats` - Get system statistics

### Departments
- `GET /api/departments` - Get all departments

### Health
- `GET /health` - Health check endpoint

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## Configuration

Copy `env.example` to `.env` and configure:

```bash
cp env.example .env
```

Key configuration options:
- `PORT`: Server port (default: 3000)
- `DB_PATH`: SQLite database path
- `JWT_SECRET`: Secret for JWT tokens
- `MAX_FILE_SIZE`: Maximum file upload size
- `UPLOAD_DIR`: Directory for uploaded files

## Database

The API uses SQLite for data storage. Tables are created automatically on first run:

- `reports`: Civic issue reports
- `departments`: Municipal departments
- `users`: Admin users (for future authentication)

## File Uploads

Images are stored in the `uploads/` directory with unique filenames. Supported formats:
- JPEG
- PNG
- GIF
- WebP

Maximum file size: 10MB

## Rate Limiting

- 100 requests per 15 minutes per IP
- Applied to all `/api/` endpoints

## CORS

CORS is enabled for all origins. Configure `CORS_ORIGIN` in `.env` for production.

## Error Handling

The API returns consistent error responses:

```json
{
  "error": "Error message"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `404`: Not Found
- `500`: Internal Server Error

## Development

### Adding New Endpoints

1. Add route in `server.js`
2. Implement handler function
3. Add validation if needed
4. Update documentation

### Database Changes

1. Modify table creation in `server.js`
2. Add migration if needed
3. Update API responses accordingly

## Testing

Run tests with:
```bash
npm test
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure proper database
3. Set up file storage (S3, etc.)
4. Configure reverse proxy (nginx)
5. Set up SSL certificates
6. Configure monitoring and logging

## Security Considerations

- Input validation on all endpoints
- File type validation for uploads
- Rate limiting to prevent abuse
- SQL injection prevention
- CORS configuration
- File size limits

## Monitoring

- Health check endpoint: `/health`
- Database connection monitoring
- File upload monitoring
- Error logging

## License

MIT License - see LICENSE file for details.

