'use client';

// TEMPORARILY DISABLED: Missing @/app/actions file
/*
import React, { useEffect } from 'react';
// import { testServerAction } from '@/app/actions'; // File doesn't exist

export function ServerActionTest() {
  useEffect(() => {
    const runTest = async () => {
      try {
        const result = await testServerAction();
        console.log('Server action result:', result);
      } catch (error) {
        console.error('Server action error:', error);
      }
    };

    runTest();
  }, []);

  const handleClick = async () => {
    try {
      const result = await testServerAction();
      console.log('Button click result:', result);
    } catch (error) {
      console.error('Button click error:', error);
    }
  };

  return (
    <div>
      <h2>Server Action Test</h2>
      <button onClick={handleClick}>Test Server Action</button>
    </div>
  );
}
*/

// Placeholder component
export function ServerActionTest() {
  return (
    <div>
      <h2>Server Action Test - Disabled</h2>
      <p>Component disabled due to missing dependencies</p>
    </div>
  );
}
