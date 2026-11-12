alter table log_lines add column course_field_sources text not null default '{"compassCourse":"input","deviation":"input","magneticCourse":"input","variation":"input","trueCourse":"input","windDrift":"input","courseThroughWater":"input","currentDrift":"input","courseOverGround":"input"}';

update log_lines set course_field_sources = '{' ||
  '"compassCourse":"' || case when compass_course is null then 'calculated' else 'input' end || '",' ||
  '"deviation":"' || case when deviation is null then 'calculated' else 'input' end || '",' ||
  '"magneticCourse":"' || case when magnetic_course is null then 'calculated' else 'input' end || '",' ||
  '"variation":"' || case when variation is null then 'calculated' else 'input' end || '",' ||
  '"trueCourse":"' || case when true_course is null then 'calculated' else 'input' end || '",' ||
  '"windDrift":"' || case when wind_drift is null then 'calculated' else 'input' end || '",' ||
  '"courseThroughWater":"' || case when course_through_water is null then 'calculated' else 'input' end || '",' ||
  '"currentDrift":"' || case when current_drift is null then 'calculated' else 'input' end || '",' ||
  '"courseOverGround":"' || case when course_over_ground is null then 'calculated' else 'input' end || '"' || '}';
