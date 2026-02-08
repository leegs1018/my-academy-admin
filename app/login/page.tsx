'use client';

import { useState } from 'react';
// 경로 수정: 한 단계 위(app), 또 한 단계 위(root)로 가서 lib를 찾습니다.
import { supabase } from '../../lib/supabase'; 
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 422 에러 방지를 위한 팁: 데이터가 비어있는지 확인
    if (!email || !password) {
      alert('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // 에러가 422라면 비밀번호가 너무 짧거나 이메일 형식이 아닐 확률이 높습니다.
      alert('로그인 실패: ' + error.message);
    } else {
      alert('로그인 성공!');
      router.push('/');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '300px' }}>
        <h2 style={{ textAlign: 'center' }}>학원 관리자 로그인</h2>
        <input 
          type="email" 
          placeholder="이메일" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
          style={{ padding: '10px', color: 'black' }} // 글자색 확인용
        />
        <input 
          type="password" 
          placeholder="비밀번호" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
          style={{ padding: '10px', color: 'black' }}
        />
        <button type="submit" style={{ padding: '10px', backgroundColor: '#0070f3', color: 'white', border: 'none', cursor: 'pointer' }}>
          로그인
        </button>
      </form>
    </div>
  );
}