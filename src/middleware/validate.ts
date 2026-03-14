// Validation middleware using Joi
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiError } from './ApiError';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(', ');
      return next(ApiError.badRequest(errorMessage));
    }

    next();
  };
};
