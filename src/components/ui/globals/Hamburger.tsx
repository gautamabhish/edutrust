'use client';

import React, { useEffect, useState, useRef } from 'react';
import clsx from 'clsx';
import Link from 'next/link';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearUser } from '@/store/userSlice';
import axios from 'axios';

const HamburgerMenu = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.user);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await axios.post('/api/users/auth/logout', {}, { withCredentials: true });
    } catch {
      // ignore error
    }
    dispatch(clearUser());
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="text-3xl text-gray-700 focus:outline-none"
      >
        ☰
      </button>

      <div
        ref={menuRef}
        className={clsx(
          'fixed top-6 right-0 w-64 h-full bg-white shadow-lg transition-transform duration-300 ease-in-out z-40',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex flex-col bg-gray-50 h-full py-6 children:cursor-pointer">
          {user ? (
            <>
              <Link href="/dashboard" className="px-4 py-2 hover:bg-blue-700 hover:text-white">
                Profile
              </Link>
              <Link href="/explore" className="px-4 py-2 hover:bg-blue-700 hover:text-white">
                Explore
              </Link>
              <Link href="/interview" className="px-4 py-2 hover:bg-blue-700 hover:text-white">
                Interview
              </Link>
              <Link href="/create-quiz" className="px-4 py-2 hover:bg-blue-700 hover:text-white">
                Create Quiz
              </Link>
              <Link href="/share-and-earn" className="px-4 py-2 hover:bg-blue-700 hover:text-white">
                Share & Earn
              </Link>
              <Link href="/support" className="px-4 py-2 hover:bg-blue-700 hover:text-white">
                Support
              </Link>
              <button
                onClick={handleSignOut}
                className="text-left px-4 py-2 hover:bg-blue-700 hover:text-white"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/" className="px-4 py-2 hover:bg-blue-700 hover:text-white">
                Home
              </Link>
              <Link href="/explore" className="px-4 py-2 hover:bg-blue-700 hover:text-white">
                Explore
              </Link>
              <Link href="/sign-in" className="px-4 py-2 hover:bg-blue-700 hover:text-white">
                Login
              </Link>
              <Link href="/sign-up" className="px-4 py-2 hover:bg-blue-700 hover:text-white">
                Sign Up
              </Link>
              <Link href="/support" className="px-4 py-2 hover:bg-blue-700 hover:text-white">
                Support
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default HamburgerMenu;
