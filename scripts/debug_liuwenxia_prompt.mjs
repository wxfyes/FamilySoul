import { PetService } from '../src/pet-service.js';

const pet = new PetService();
pet._viewerActorId = 'liuwenxia';
pet._actorPersonaOverride = [
  '玩家扮演的是紫嫣。你不演她——她已经由真人控制。',
  '你负责演这个世界的其他人：王甯、阿吉等。',
].join('\n');

const prompt = pet.buildSystemPrompt('贴心管家', 'text', 'liuwenxia');
console.log('=== SYSTEM PROMPT FOR LIUWENXIA ===');
console.log(prompt);
