/**
 * Authentication Debug Test
 *
 * Tests the authentication system and checks database connectivity
 */

const { createClient } = require('@supabase/supabase-js');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');

// Load environment variables
require('dotenv').config();

async function testAuth() {
  console.log('🔍 Testing Authentication System...\n');

  // 1. Check environment variables
  console.log('1. Environment Variables:');
  console.log(
    '  ✅ NEXT_PUBLIC_SUPABASE_URL:',
    !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  console.log(
    '  ✅ SUPABASE_SERVICE_ROLE_KEY:',
    !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  console.log('  ✅ POSTGRES_URL:', !!process.env.POSTGRES_URL);
  console.log('  ✅ AUTH_SECRET:', !!process.env.AUTH_SECRET);
  console.log('  ✅ AUTH_GOOGLE_ID:', !!process.env.AUTH_GOOGLE_ID);
  console.log('  ✅ AUTH_GOOGLE_SECRET:', !!process.env.AUTH_GOOGLE_SECRET);
  console.log('');

  // 2. Test Supabase connection
  try {
    console.log('2. Testing Supabase Connection...');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const { data, error } = await supabase
      .from('User')
      .select('count')
      .limit(1);
    if (error) {
      console.log('  ❌ Supabase Error:', error.message);
    } else {
      console.log('  ✅ Supabase connected successfully');
    }
  } catch (error) {
    console.log('  ❌ Supabase connection failed:', error.message);
  }
  console.log('');

  // 3. Test direct database connection
  try {
    console.log('3. Testing Direct Database Connection...');
    const sql = postgres(process.env.POSTGRES_URL, { prepare: false, max: 1 });

    const result = await sql`SELECT COUNT(*) as count FROM "User"`;
    console.log('  ✅ Database connected successfully');
    console.log('  📊 Users in database:', result[0].count);

    // Get sample users
    const users = await sql`SELECT id, email, role FROM "User" LIMIT 3`;
    if (users.length > 0) {
      console.log('  👥 Sample users:');
      users.forEach((user) => {
        console.log(`    - ${user.email} (${user.role}) - ${user.id}`);
      });
    } else {
      console.log('  📝 No users found in database');
    }

    await sql.end();
  } catch (error) {
    console.log('  ❌ Database connection failed:', error.message);
  }
  console.log('');

  // 4. Test NextAuth configuration
  console.log('4. NextAuth Configuration:');
  console.log('  🔐 AUTH_SECRET length:', process.env.AUTH_SECRET?.length || 0);
  console.log(
    '  🔗 Google OAuth configured:',
    !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  );
  console.log('');

  console.log('✅ Authentication debug test completed!');
}

testAuth().catch(console.error);
