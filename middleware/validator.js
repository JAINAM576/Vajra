/**
 * Vajra Lock App — Request Body Schema Validation Middleware
 * Provides zero-dependency schema validation for Express routes.
 */

/**
 * Express middleware generator to validate request bodies against a schema.
 * @param {Object} schema - Validation schema mapping body fields to validation rules
 * @returns {Function} Express middleware function
 */
const validate = (schema) => {
  return (req, res, next) => {
    const errors = {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      // Check required
      if (rules.required && (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))) {
        errors[field] = rules.requiredMessage || `${field} is required.`;
        continue;
      }

      // Check format/type rules only if value is present
      if (value !== undefined && value !== null && value !== '') {
        // Min Length check
        if (rules.minLength && String(value).length < rules.minLength) {
          errors[field] = rules.minLengthMessage || `${field} must be at least ${rules.minLength} characters.`;
        }

        // Max Length check
        if (rules.maxLength && String(value).length > rules.maxLength) {
          errors[field] = rules.maxLengthMessage || `${field} must be at most ${rules.maxLength} characters.`;
        }

        // Pattern regex check
        if (rules.pattern && !rules.pattern.test(String(value))) {
          errors[field] = rules.message || `${field} format is invalid.`;
        }

        // Custom function check
        if (rules.custom && typeof rules.custom === 'function') {
          const customError = rules.custom(value, req);
          if (customError) {
            errors[field] = customError;
          }
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      // Return the first error message to match current codebase style
      const firstErrorMessage = Object.values(errors)[0];
      return res.status(400).json({
        success: false,
        message: firstErrorMessage,
        data: {},
      });
    }

    next();
  };
};

module.exports = validate;
