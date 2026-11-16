export function errorHandler(err, req, res, next) {
  console.error('Unhandled Server Error:', err);

  // Handle PostgreSQL foreign key violation (23503)
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Referenced foreign key entity does not exist.',
      detail: err.detail,
    });
  }

  // Handle PostgreSQL check violation (23514)
  if (err.code === '23514') {
    return res.status(400).json({
      success: false,
      message: 'Database check constraint failed: Invalid field value.',
      detail: err.detail,
    });
  }

  // Handle PostgreSQL syntax or query execution errors
  if (err.code && err.routine) {
    return res.status(500).json({
      success: false,
      message: 'Database execution error occurred.',
      detail: err.message,
    });
  }

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
}

