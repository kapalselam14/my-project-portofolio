function sendSuccess(res, data = {}, message = 'OK', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

function sendError(res, message = 'Bad Request', statusCode = 400, errors = null) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors
  });
}

module.exports = { sendSuccess, sendError };