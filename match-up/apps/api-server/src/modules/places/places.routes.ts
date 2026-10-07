import { Router } from 'express';
import { autocompletePlacesHandler } from './places.controller.js';

export const placesRouter = Router();

// No requireAuth: place autocomplete is not user data, and the mobile create wizard is reachable pre-login.
placesRouter.get('/autocomplete', autocompletePlacesHandler);
