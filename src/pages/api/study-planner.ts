import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { student_id, plan_date } = req.query;
      
      if (!student_id) {
        // Return empty plan for demo/unauthenticated users
        return res.status(200).json({ plan: null });
      }

      const targetDate = (plan_date as string) || new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('study_plans')
        .select('*')
        .eq('student_id', student_id)
        .eq('plan_date', targetDate)
        .maybeSingle();

      if (error) {
        console.error('Study plan fetch error:', error);
        return res.status(200).json({ plan: null });
      }

      return res.status(200).json({ plan: data });
    } catch (e: any) {
      console.error('Study planner API error:', e);
      return res.status(200).json({ plan: null });
    }
  }

  if (req.method === 'POST') {
    try {
      const { student_id, plan_date, tasks } = req.body;

      if (!tasks) {
        return res.status(400).json({ error: 'tasks are required' });
      }

      if (!student_id) {
        // For demo: just return the tasks without saving
        return res.status(200).json({ 
          plan: { 
            tasks, 
            plan_date: plan_date || new Date().toISOString().split('T')[0] 
          } 
        });
      }

      const targetDate = plan_date || new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('study_plans')
        .upsert(
          {
            student_id,
            plan_date: targetDate,
            tasks,
            created_at: new Date().toISOString()
          },
          { onConflict: 'student_id, plan_date' }
        )
        .select()
        .single();

      if (error) {
        console.error('Study plan save error:', error);
        return res.status(200).json({ 
          plan: { tasks, plan_date: targetDate } 
        });
      }

      return res.status(200).json({ plan: data });
    } catch (e: any) {
      console.error('Study planner POST error:', e);
      return res.status(200).json({ 
        plan: { 
          tasks: req.body.tasks, 
          plan_date: req.body.plan_date || new Date().toISOString().split('T')[0] 
        } 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
