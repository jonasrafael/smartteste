# Troubleshooting Guide

## Common Issues and Solutions

### 1. Device Discovery Errors

#### Error: "❌ API format error. Please try refreshing the page and logging in again."
**Cause**: Content-Type mismatch with Tuya API
**Solution**: 
- Refresh the page and log in again
- The system will automatically try alternative content types
- Check browser console for detailed error logs

#### Error: "🌐 Network connection issue. Please check your internet connection and try again."
**Cause**: Network connectivity problems or API timeout
**Solution**:
- Check your internet connection
- Wait a few seconds and click "Refresh Devices" again
- The system automatically retries up to 3 times

#### Error: "🚫 Too many requests. Please wait a moment before trying again."
**Cause**: Tuya API rate limiting (max 1 request per 3 minutes)
**Solution**:
- Wait 3 minutes before trying again
- The countdown timer will show remaining wait time
- This is a Tuya API limitation, not a bug

### 2. Login Issues

#### Error: "🚫 Rate limit exceeded!"
**Cause**: Too many login attempts in short time
**Solution**:
- Wait for the countdown timer to complete
- Tuya allows only 1 login attempt per 3 minutes
- Check your credentials before attempting again

#### Error: "❌ Authentication expired. Please log in again."
**Cause**: Session token has expired
**Solution**:
- Log in again with your credentials
- Sessions typically last 24 hours
- Check if your Tuya account is still active

### 3. Device Control Issues

#### Error: "❌ Device control error"
**Cause**: Device offline or API communication failure
**Solution**:
- Check if the device is online in the Tuya app
- Ensure your internet connection is stable
- Try refreshing the device list first

### 4. Performance Issues

#### Slow Device Discovery
**Cause**: Network latency or API response time
**Solution**:
- The system automatically retries failed requests
- Check your internet connection speed
- Consider using a wired connection for better stability

#### App Not Responding
**Cause**: Multiple simultaneous requests or heavy operations
**Solution**:
- Wait for current operations to complete
- Don't click buttons multiple times
- Refresh the page if completely unresponsive

## Debug Information

### Console Logs
The application provides detailed logging in the browser console:
- 🔍 Device discovery attempts
- 🔄 Retry strategies
- ⚠️ Error details
- ✅ Success confirmations

### Network Tab
Check the Network tab in browser DevTools for:
- API request/response details
- HTTP status codes
- Response headers and content

### Common HTTP Status Codes
- **200**: Success
- **401**: Unauthorized (login required)
- **415**: Unsupported Media Type (automatically handled)
- **429**: Too Many Requests (rate limited)
- **500**: Server Error

## Prevention Tips

1. **Stable Connection**: Use a reliable internet connection
2. **Single Operations**: Don't click buttons multiple times
3. **Regular Refresh**: Refresh device list periodically
4. **Session Management**: Log out and back in if experiencing issues
5. **Browser Compatibility**: Use modern browsers (Chrome, Firefox, Safari, Edge)

## Getting Help

If you continue experiencing issues:

1. Check this troubleshooting guide
2. Review browser console for error details
3. Check your Tuya account status
4. Verify internet connectivity
5. Try in a different browser or device

## Technical Support

For technical support, provide:
- Error message from the app
- Browser console logs
- Steps to reproduce the issue
- Your device and browser information
