import { verifySession } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import { createInterestProfile } from './profile'
import 'server-only'

export const interestProfile = createInterestProfile({ database: db, verifySession })
