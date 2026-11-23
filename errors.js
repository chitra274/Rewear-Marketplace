export function notFound(req, res) {
  res.status(404).json({ error: 'NOT_FOUND', message: 'The requested endpoint does not exist.' });
}

export function errorHandler(err, req, res, next) {
  console.error(err);
  if (err?.name === 'ZodError') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Please check the submitted fields.', details: err.issues });
  }
  if (err?.code === '23505') return res.status(409).json({ error: 'DUPLICATE', message: 'A record with these details already exists.' });
  if (err?.code === '23503' || err?.code === '23514') return res.status(400).json({ error: 'DATABASE_CONSTRAINT', message: 'The request violates a data rule.' });
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
}
